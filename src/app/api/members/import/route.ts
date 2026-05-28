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
        const periodMonth = (formData.get("periodMonth") as string) || null;

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
        const uraianGajiSheet = workbook.SheetNames.find(s => s.toUpperCase().includes('URAIAN GAJI'));
        if (importType === 'gaji_uraian' && uraianGajiSheet) {
             sheetName = uraianGajiSheet;
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

        // For gaji import with merged multi-row headers (POT GAJI sheets):
        // Row 0 = group headers ("JML", "JUMLAH GAJI"), Row 1 = sub-headers ("GAJI", "DITERIMA").
        // Merge them to get full column labels ("jml gaji", "jumlah gaji diterima").
        if (importType === "gaji" && headerRowIndex + 1 < rows.length) {
            const nextRow = rows[headerRowIndex + 1];
            for (let c = 0; c < headers.length; c++) {
                const sub = String(nextRow[c] || "").toLowerCase().trim();
                if (sub && !headers[c].includes(sub)) {
                    headers[c] = (headers[c] + " " + sub).trim();
                }
            }
        }

        const dataRows = rows.slice(headerRowIndex + (importType === "gaji" ? 2 : 1));

        let result;
        switch (importType) {
            case "tunkin":
                result = await processTunkinImport(headers, dataRows, mode);
                break;
            case "gaji":
                result = await processGajiImport(headers, dataRows, mode);
                break;
            case "gaji_uraian":
                result = await processGajiUraianImport(dataRows, mode);
                break;
            case "tajib":
                result = await processTajibImport(headers, dataRows, mode, periodMonth);
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
// Simple TAJIP Import (NRP + TAJIB amount only → monthly wajib deposit)
// ==========================================
async function processSimpleTajipImport(
    headers: string[],
    dataRows: string[][],
    mode: string,
    periodMonth: string,
    nrpIdx: number,
    namaIdx: number,
    tajibIdx: number,
) {
    const MONTH_NAMES = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];

    const [yearStr, monthStr] = periodMonth.split("-");
    const periodYear = parseInt(yearStr, 10);
    const periodMonthNum = parseInt(monthStr, 10);
    const monthName = MONTH_NAMES[periodMonthNum - 1];
    const notesLabel = `Setoran Import TAJIB: ${monthName.toUpperCase()}`;
    // Transaction date = 28th of the period month
    const txDate = new Date(periodYear, periodMonthNum - 1, 28);

    const sysUser = await prisma.user.findFirst({ where: { isActive: true } });
    const sysUserId = sysUser ? sysUser.id : 1;

    const allMembers = await prisma.member.findMany({
        where: { deletedAt: null },
        include: { savingsAccounts: { include: { product: true } } },
    });

    const globalWProd = await prisma.savingsProduct.findFirst({ where: { type: "wajib" } });

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;
    const commitTasks: (() => Promise<void>)[] = [];

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length === 0) continue;

        const nrp = nrpIdx >= 0 ? cleanNrp(row[nrpIdx] || '') : '';
        const rawNama = namaIdx >= 0 ? String(row[namaIdx] || '').trim() : '';

        if (!rawNama || rawNama.toUpperCase() === 'NAMA' || rawNama === '0') continue;
        if (/^\d+(\.\d+)?$/.test(rawNama)) continue;

        const tajibAmount = tajibIdx >= 0 ? cleanNumber(row[tajibIdx]) : 0;

        // Skip zero or negative TAJIB (e.g. GAGAL POT entries)
        if (tajibAmount <= 0) {
            results.push({
                row: i + 2, nrp, nama: rawNama, tajib: tajibAmount,
                status: 'error', reason: 'TAJIB = 0 (GAGAL POT / tanpa potongan)',
            });
            failCount++;
            continue;
        }

        const csvCleanName = cleanNameForMatch(rawNama);

        let matches: any[] = [];
        // Level 1: NRP match (most reliable)
        if (nrp) matches = allMembers.filter(m => m.nrp === nrp || m.memberNo === nrp);
        // Level 2: Exact full name match
        if (matches.length === 0) matches = allMembers.filter(m => cleanNameForMatch(m.name) === csvCleanName);
        // Level 3: Word-token overlap scoring (handles ambiguous/short names)
        if (matches.length === 0) {
            const csvTokens = csvCleanName.split(/\s+/).filter(t => t.length >= 2);
            if (csvTokens.length >= 1) {
                const scored = allMembers.map(m => {
                    const dbTokens = cleanNameForMatch(m.name).split(/\s+/).filter(t => t.length >= 2);
                    let overlap = 0;
                    for (const ct of csvTokens) {
                        if (dbTokens.some(dt => dt === ct)) overlap++;
                    }
                    const minOverlap = Math.min(csvTokens.length, dbTokens.length) >= 2 ? 2 : 1;
                    const score = overlap >= minOverlap ? overlap / Math.max(csvTokens.length, dbTokens.length) : 0;
                    return { m, score };
                }).filter(s => s.score > 0);

                scored.sort((a, b) => b.score - a.score);
                if (scored.length > 0 && scored[0].score >= 0.4) {
                    matches = [scored[0].m];
                }
            }
        }
        // Level 4: Last-resort substring match (strict: ≥5 chars)
        if (matches.length === 0) {
            matches = allMembers.filter(m => {
                const dbName = cleanNameForMatch(m.name);
                return (dbName.includes(csvCleanName) || csvCleanName.includes(dbName)) && csvCleanName.length >= 5;
            });
        }

        if (matches.length === 0) {
            results.push({
                row: i + 2, nrp, nama: rawNama, tajib: tajibAmount,
                status: 'error', reason: 'Anggota tdk ditemukan',
            });
            failCount++;
            continue;
        }

        const member = matches[0];

        if (mode === "commit") {
            commitTasks.push(async () => {
                try {
                    await prisma.$transaction(async (tx) => {
                        let wajibAcc = member.savingsAccounts.find((a: any) => a.product.type === "wajib");

                        // Create wajib account if not exists
                        if (!wajibAcc && globalWProd) {
                            wajibAcc = await tx.savingsAccount.create({
                                data: {
                                    memberId: member.id,
                                    productId: globalWProd.id,
                                    branchId: member.branchId,
                                    balance: 0,
                                    status: "active",
                                    accountNo: `WJB-${member.memberNo || member.id}-${Date.now()}`,
                                    openedDate: new Date(),
                                },
                                include: { product: true },
                            });
                        }

                        if (!wajibAcc) throw new Error("Produk simpanan wajib tidak ditemukan");

                        const currentBalance = Number(wajibAcc.balance);

                        // Idempotency: check for existing deposit for this month
                        const existingTx = await tx.savingsTransaction.findFirst({
                            where: {
                                accountId: wajibAcc.id,
                                notes: notesLabel,
                            },
                        });

                        if (existingTx) {
                            const diff = tajibAmount - Number(existingTx.amount);
                            if (diff !== 0) {
                                await tx.savingsTransaction.create({
                                    data: {
                                        transactionNo: `IMP-KOR-${monthName.toUpperCase()}-${member.id}-${Date.now()}-${i}`,
                                        accountId: wajibAcc.id,
                                        memberId: member.id,
                                        productId: wajibAcc.productId,
                                        branchId: member.branchId,
                                        type: diff > 0 ? 'deposit' : 'correction',
                                        amount: Math.abs(diff),
                                        balanceBefore: currentBalance,
                                        balanceAfter: currentBalance + diff,
                                        notes: `Koreksi Edit ${notesLabel}`,
                                        transactionDate: txDate,
                                        createdById: sysUserId,
                                    },
                                });
                                await tx.savingsAccount.update({
                                    where: { id: wajibAcc.id },
                                    data: { balance: currentBalance + diff },
                                });
                            }
                        } else {
                            await tx.savingsTransaction.create({
                                data: {
                                    transactionNo: `IMP-${monthName.toUpperCase()}-${member.id}-${Date.now()}-${i}`,
                                    accountId: wajibAcc.id,
                                    memberId: member.id,
                                    productId: wajibAcc.productId,
                                    branchId: member.branchId,
                                    type: 'deposit',
                                    amount: tajibAmount,
                                    balanceBefore: currentBalance,
                                    balanceAfter: currentBalance + tajibAmount,
                                    notes: notesLabel,
                                    transactionDate: txDate,
                                    createdById: sysUserId,
                                },
                            });
                            await tx.savingsAccount.update({
                                where: { id: wajibAcc.id },
                                data: { balance: currentBalance + tajibAmount },
                            });
                        }
                    });

                    results.push({
                        row: i + 2, nrp: member.nrp || nrp, nama: rawNama,
                        tajib: tajibAmount,
                        memberId: member.id, memberName: member.name,
                        status: 'valid', reason: `Setoran Wajib ${monthName} ${periodYear}: ${tajibAmount}`,
                    });
                    successCount++;
                } catch (e) {
                    results.push({
                        row: i + 2, nrp, nama: rawNama, tajib: tajibAmount,
                        status: 'error', reason: 'Database Error: ' + e,
                    });
                    failCount++;
                }
            });
        } else {
            results.push({
                row: i + 2, nrp: member.nrp || nrp, nama: rawNama, tajib: tajibAmount,
                memberId: member.id, memberName: member.name,
                status: 'valid', reason: `Akan dibuat setoran Wajib ${monthName} ${periodYear}`,
                currentTajib: tajibAmount,
            });
            successCount++;
        }
    }

    if (mode === "commit") {
        const CHUNK_SIZE = 5;
        for (let i = 0; i < commitTasks.length; i += CHUNK_SIZE) {
            const chunk = commitTasks.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(fn => fn()));
        }
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
// Tajib Import (Simpanan Wajib & Sejarah Mutasi)
// ==========================================
async function processTajibImport(headers: string[], dataRows: string[][], mode: string, periodMonth: string | null = null) {
    let nrpIdx = headers.findIndex(h => h.includes("nrp") || h.includes("nip") || h === "nrp/nip");
    const namaIdx = headers.findIndex(h => h.includes("nama") || h.includes("nmpeg"));

    // Auto-detect unlabeled NRP column: if col 0 has no header but data rows contain 6-10 digit numbers
    if (nrpIdx === -1 && namaIdx > 0) {
        const sampleSize = Math.min(10, dataRows.length);
        let nrpLikeCount = 0;
        for (let i = 0; i < sampleSize; i++) {
            const val = String(dataRows[i]?.[0] || "").trim();
            if (/^\d{6,10}$/.test(val)) nrpLikeCount++;
        }
        if (nrpLikeCount >= sampleSize * 0.7) {
            nrpIdx = 0;
        }
    }
    
    // Temukan POKOK dan WAJIB dasar
    // PENTING: Excel punya 2 kelompok kolom identik (Saldo Lama & Saldo Baru).
    // Kita HARUS mengambil kolom TERAKHIR (Grup 2 = Saldo Terkini) menggunakan reverse search.
    const findLastIdx = (predicate: (h: string) => boolean): number => {
        for (let i = headers.length - 1; i >= 0; i--) {
            if (predicate(headers[i])) return i;
        }
        return -1;
    };
    const pokokIdx = findLastIdx(h => h === "pokok" || h === "simpanan pokok");
    const wajibIdx = findLastIdx(h => h === "wajib" || h.includes("saldo wajib"));
    const sukarelaIdx = findLastIdx(h => h === "ms" || h === "m s" || h.includes("sukarela") || h === "manasuka" || h === "m.s" || h === "m.s.");
    
    // Safety check for createdById
    const sysUser = await prisma.user.findFirst({ where: { isActive: true } });
    const sysUserId = sysUser ? sysUser.id : 1;

    // Temukan kolom JML
    let tajibIdx = -1;
    for (let i = headers.length - 1; i >= 0; i--) {
        const h = headers[i];
        if (h.includes("jml") || h.includes("jumlah") || h === "tajib" || h.includes("tajip")) {
            tajibIdx = i;
            break;
        }
    }

    if (namaIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom NAMA / NRP wajib ada di header Excel Bapak.",
            preview: [],
        };
    }

    // Temukan pilar bulan (Jan-Des) dengan toleransi typo
    const monthNames = ["januari", "pebruari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
    const monthCols: { name: string, idx: number }[] = [];
    headers.forEach((h, idx) => {
        const mh = h.toLowerCase().trim();
        // Regex pencocokan singkatan atau typo bulan
        if (
            monthNames.includes(mh) || 
            /^jan(uari)?$/i.test(mh) || 
            /^feb(ruari)?|pebruari$/i.test(mh) || 
            /^mar(et)?|mrt$/i.test(mh) || 
            /^apr(il)?$/i.test(mh) || 
            /^mei|may$/i.test(mh) || 
            /^jun(i)?$/i.test(mh) || 
            /^jul(i)?$/i.test(mh) || 
            /^agu(stus)?|agt$/i.test(mh) || 
            /^sep(tember)?|sept?$/i.test(mh) || 
            /^okt(ober)?|oct$/i.test(mh) || 
            /^nov(ember)?$/i.test(mh) || 
            /^des(ember)?|dec$/i.test(mh)
        ) {
            // Mapekan nama ke format baku untuk konsistensi
            let standardName = mh;
            if (/^jan/i.test(mh)) standardName = "januari";
            if (/^feb|peb/i.test(mh)) standardName = "februari";
            if (/^mar|mrt/i.test(mh)) standardName = "maret";
            if (/^apr/i.test(mh)) standardName = "april";
            if (/^mei|may/i.test(mh)) standardName = "mei";
            if (/^jun/i.test(mh)) standardName = "juni";
            if (/^jul/i.test(mh)) standardName = "juli";
            if (/^agu|agt/i.test(mh)) standardName = "agustus";
            if (/^sep/i.test(mh)) standardName = "september";
            if (/^okt|oct/i.test(mh)) standardName = "oktober";
            if (/^nov/i.test(mh)) standardName = "november";
            if (/^des|dec/i.test(mh)) standardName = "desember";
            
            monthCols.push({ name: standardName, idx });
        }
    });

    // ── Detect Simple TAJIP Format ──────────────────────────────────────
    // TAJIP files only have NRP + TAJIB amount + NAMA (no saldo/monthly columns).
    // When detected + periodMonth provided, create monthly wajib deposits for that period.
    const isSimpleTajip = tajibIdx >= 0 && monthCols.length === 0 && pokokIdx === -1 && wajibIdx === -1 && sukarelaIdx === -1;

    if (isSimpleTajip && periodMonth) {
        return await processSimpleTajipImport(headers, dataRows, mode, periodMonth, nrpIdx, namaIdx, tajibIdx);
    }

    const allMembers = await prisma.member.findMany({
        where: { deletedAt: null },
        include: { savingsAccounts: { include: { product: true } } }
    });

    const globalPProd = await prisma.savingsProduct.findFirst({ where: { type: "pokok" }});
    const globalWProd = await prisma.savingsProduct.findFirst({ where: { type: "wajib" }});
    const globalSProd = await prisma.savingsProduct.findFirst({ where: { type: "sukarela" }});

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;
    const commitTasks: (() => Promise<void>)[] = [];

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length === 0) continue;

        const nrp = nrpIdx >= 0 ? cleanNrp(row[nrpIdx] || '') : '';
        const rawNama = String(row[namaIdx] || '').trim();
        
        if (!rawNama || rawNama.toUpperCase() === 'NAMA' || rawNama === '0') continue;
        if (/^\d+(\.\d+)?$/.test(rawNama)) continue;

        const pokok = pokokIdx >= 0 ? cleanNumber(row[pokokIdx]) : 0;
        const wajibAwal = wajibIdx >= 0 ? cleanNumber(row[wajibIdx]) : 0;
        const sukarelaAwal = sukarelaIdx >= 0 ? cleanNumber(row[sukarelaIdx]) : 0;
        
        let totalJmlNum = 0;
        if (tajibIdx >= 0) {
            totalJmlNum = cleanNumber(row[tajibIdx]);
        }

        const monthlyDeposits: { monthName: string, amount: number }[] = [];
        monthCols.forEach(mc => {
            const amt = cleanNumber(row[mc.idx]);
            if (amt > 0) {
                monthlyDeposits.push({ monthName: mc.name, amount: amt });
            }
        });

        // Kalkulasi dinamis jika kolom JML absen
        if (tajibIdx === -1) {
            totalJmlNum = pokok + wajibAwal + sukarelaAwal + monthlyDeposits.reduce((acc, curr) => acc + curr.amount, 0);
        }

        const csvCleanName = cleanNameForMatch(rawNama);

        let matches: any[] = [];
        // Level 1: NRP match
        if (nrp) matches = allMembers.filter(m => m.nrp === nrp || m.memberNo === nrp);
        // Level 2: Exact full name
        if (matches.length === 0) matches = allMembers.filter(m => cleanNameForMatch(m.name) === csvCleanName);
        // Level 3: Word-token overlap scoring
        if (matches.length === 0) {
            const csvTokens = csvCleanName.split(/\s+/).filter(t => t.length >= 2);
            if (csvTokens.length >= 1) {
                const scored = allMembers.map(m => {
                    const dbTokens = cleanNameForMatch(m.name).split(/\s+/).filter(t => t.length >= 2);
                    let overlap = 0;
                    for (const ct of csvTokens) { if (dbTokens.some(dt => dt === ct)) overlap++; }
                    const minOverlap = Math.min(csvTokens.length, dbTokens.length) >= 2 ? 2 : 1;
                    const score = overlap >= minOverlap ? overlap / Math.max(csvTokens.length, dbTokens.length) : 0;
                    return { m, score };
                }).filter(s => s.score > 0);
                scored.sort((a, b) => b.score - a.score);
                if (scored.length > 0 && scored[0].score >= 0.4) matches = [scored[0].m];
            }
        }
        // Level 4: Last-resort substring (≥5 chars)
        if (matches.length === 0) {
            matches = allMembers.filter(m => {
                const dbName = cleanNameForMatch(m.name);
                return (dbName.includes(csvCleanName) || csvCleanName.includes(dbName)) && csvCleanName.length >= 5;
            });
        }

        if (matches.length === 0) {
            results.push({
                row: i + 2, nrp, nama: rawNama, tajib: totalJmlNum,
                status: 'error', reason: 'Anggota tdk ditemukan',
            });
            failCount++;
            continue;
        }

        const member = matches[0];

        if (mode === "commit") {
            commitTasks.push(async () => {
                try {
                    await prisma.$transaction(async (tx) => {
                        let pokokAcc = member.savingsAccounts.find((a: any) => a.product.type === "pokok");
                        let wajibAcc = member.savingsAccounts.find((a: any) => a.product.type === "wajib");
                        let sukarelaAcc = member.savingsAccounts.find((a: any) => a.product.type === "sukarela");

                        // Create account if not exists
                        if (!pokokAcc && pokok > 0 && globalPProd) {
                            pokokAcc = await tx.savingsAccount.create({
                                data: { memberId: member.id, productId: globalPProd.id, branchId: member.branchId, balance: 0, status: "active", accountNo: `PKK-${member.memberNo || member.id}-${Date.now()}`, openedDate: new Date() },
                                include: { product: true }
                            });
                        }
                        if (!wajibAcc && (wajibAwal > 0 || monthlyDeposits.length > 0) && globalWProd) {
                            wajibAcc = await tx.savingsAccount.create({
                                data: { memberId: member.id, productId: globalWProd.id, branchId: member.branchId, balance: 0, status: "active", accountNo: `WJB-${member.memberNo || member.id}-${Date.now()}`, openedDate: new Date() },
                                include: { product: true }
                            });
                        }
                        if (!sukarelaAcc && sukarelaAwal > 0 && globalSProd) {
                            sukarelaAcc = await tx.savingsAccount.create({
                                data: { memberId: member.id, productId: globalSProd.id, branchId: member.branchId, balance: 0, status: "active", accountNo: `SKR-${member.memberNo || member.id}-${Date.now()}`, openedDate: new Date() },
                                include: { product: true }
                            });
                        }

                        let currentPokok = pokokAcc ? Number(pokokAcc.balance) : 0;
                        let currentWajib = wajibAcc ? Number(wajibAcc.balance) : 0;
                        let currentSukarela = sukarelaAcc ? Number(sukarelaAcc.balance) : 0;

                        // 1. Simpanan Pokok
                        if (pokokAcc && pokok > 0) {
                            const diff = pokok - currentPokok;
                            if (diff !== 0) {
                                await tx.savingsTransaction.create({
                                    data: {
                                        transactionNo: `IMP-PKK-${member.id}-${Date.now()}-${i}`,
                                        accountId: pokokAcc.id,
                                        memberId: member.id,
                                        productId: pokokAcc.productId,
                                        branchId: member.branchId,
                                        type: 'correction',
                                        amount: Math.abs(diff),
                                        balanceBefore: currentPokok,
                                        balanceAfter: pokok,
                                        notes: 'Import Saldo Awal Pokok (Excel TAJIB)',
                                        transactionDate: new Date(),
                                        createdById: sysUserId
                                    }
                                });
                                currentPokok = pokok;
                            }
                        }

                        // 2. Simpanan Wajib (Saldo Awal Kolom WAJIB & Monthly Idempotency)
                        if (wajibAcc) {
                            // Find existing monthly deposits first to establish correct Base Wajib Awal
                            const existingMonthlyDeps = await tx.savingsTransaction.findMany({
                                where: { accountId: wajibAcc.id, notes: { startsWith: 'Setoran Import TAJIB:' } }
                            });
                            const sumMonthlyDeps = existingMonthlyDeps.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
                            const trueCurrentWajibAwal = currentWajib - sumMonthlyDeps;
                            
                            // 2A. Update Saldo Wajib Awal jika ada perubahan
                            if (wajibAwal > 0) {
                                const wDiff = wajibAwal - trueCurrentWajibAwal;
                                if (wDiff !== 0) {
                                    await tx.savingsTransaction.create({
                                        data: {
                                            transactionNo: `IMP-WJB-${member.id}-${Date.now()}-${i}`,
                                            accountId: wajibAcc.id,
                                            memberId: member.id,
                                            productId: wajibAcc.productId,
                                            branchId: member.branchId,
                                            type: wDiff > 0 ? 'deposit' : 'correction',
                                            amount: Math.abs(wDiff),
                                            balanceBefore: currentWajib,
                                            balanceAfter: currentWajib + wDiff,
                                            notes: 'Import/Update Saldo Wajib Awal (Excel TAJIB)',
                                            transactionDate: new Date(),
                                            createdById: sysUserId
                                        }
                                    });
                                    currentWajib += wDiff;
                                }
                            }

                            // 2B. Update / Insert Monthly Deposits (Idempotent)
                            for (const dep of monthlyDeposits) {
                                const notesLabel = `Setoran Import TAJIB: ${dep.monthName.toUpperCase()}`;
                                const existingTx = existingMonthlyDeps.find((d: any) => d.notes === notesLabel);
                                
                                if (existingTx) {
                                    const depDiff = dep.amount - Number(existingTx.amount);
                                    if (depDiff !== 0) {
                                        await tx.savingsTransaction.create({
                                            data: {
                                                transactionNo: `IMP-KOR-${dep.monthName.toUpperCase()}-${member.id}-${Date.now()}-${i}`,
                                                accountId: wajibAcc.id, memberId: member.id, productId: wajibAcc.productId, branchId: member.branchId,
                                                type: depDiff > 0 ? 'deposit' : 'correction', 
                                                amount: Math.abs(depDiff), 
                                                balanceBefore: currentWajib, 
                                                balanceAfter: currentWajib + depDiff,
                                                notes: `Koreksi Edit ${notesLabel}`, 
                                                transactionDate: new Date(), 
                                                createdById: sysUserId
                                            }
                                        });
                                        currentWajib += depDiff;
                                    }
                                } else {
                                    let mNum = monthNames.indexOf(dep.monthName.toLowerCase()) + 1;
                                    if (mNum <= 0) mNum = 1; 
                                    const yr = new Date().getFullYear();
                                    const mockDate = new Date(yr, mNum - 1, 28); 
                                    
                                    await tx.savingsTransaction.create({
                                        data: {
                                            transactionNo: `IMP-${dep.monthName.toUpperCase()}-${member.id}-${Date.now()}-${i}`,
                                            accountId: wajibAcc.id,
                                            memberId: member.id,
                                            productId: wajibAcc.productId,
                                            branchId: member.branchId,
                                            type: 'deposit',
                                            amount: dep.amount,
                                            balanceBefore: currentWajib,
                                            balanceAfter: currentWajib + dep.amount,
                                            notes: notesLabel,
                                            transactionDate: mockDate,
                                            createdById: sysUserId
                                        }
                                    });
                                    currentWajib += dep.amount;
                                }
                            }
                        }

                        // 4. Simpanan Sukarela (MS)
                        if (sukarelaAcc && sukarelaAwal > 0) {
                            const sDiff = sukarelaAwal - currentSukarela;
                            if (sDiff !== 0) {
                                await tx.savingsTransaction.create({
                                    data: {
                                        transactionNo: `IMP-SKR-${member.id}-${Date.now()}-${i}`,
                                        accountId: sukarelaAcc.id,
                                        memberId: member.id,
                                        productId: sukarelaAcc.productId,
                                        branchId: member.branchId,
                                        type: 'correction',
                                        amount: Math.abs(sDiff),
                                        balanceBefore: currentSukarela,
                                        balanceAfter: sukarelaAwal,
                                        notes: 'Import Saldo Sukarela / MS (Excel TAJIB)',
                                        transactionDate: new Date(),
                                        createdById: sysUserId
                                    }
                                });
                                currentSukarela = sukarelaAwal;
                            }
                        }

                        // Update balances at the end
                        if (pokokAcc) await tx.savingsAccount.update({ where: { id: pokokAcc.id }, data: { balance: currentPokok } });
                        if (wajibAcc) await tx.savingsAccount.update({ where: { id: wajibAcc.id }, data: { balance: currentWajib } });
                        if (sukarelaAcc) await tx.savingsAccount.update({ where: { id: sukarelaAcc.id }, data: { balance: currentSukarela } });
                    });

                    results.push({
                        row: i + 2, nrp: member.nrp || nrp, nama: rawNama, 
                        tajib: totalJmlNum, 
                        memberId: member.id, memberName: member.name,
                        status: 'valid', reason: `Masuk: PKK (${pokok}), WJB_Awl (${wajibAwal}), MS (${sukarelaAwal}), +${monthlyDeposits.length} bln`,
                        currentTajib: (pokok + sukarelaAwal + wajibAwal + monthlyDeposits.reduce((a,b) => a+b.amount, 0)),
                    });
                    successCount++;
                } catch(e) {
                    results.push({
                        row: i + 2, nrp, nama: rawNama, tajib: totalJmlNum,
                        status: 'error', reason: 'Database Error: ' + e,
                    });
                    failCount++;
                }
            });
        } else {
            // Preview
            results.push({
                row: i + 2, nrp: member.nrp || nrp, nama: rawNama, tajib: totalJmlNum,

                memberId: member.id, memberName: member.name,
                status: 'valid', reason: `Dideteksi: PKK (${pokok}), WJB_Awl (${wajibAwal}), MS (${sukarelaAwal}), +${monthlyDeposits.length} bln setoran`,
                currentTajib: (pokok + sukarelaAwal + wajibAwal + monthlyDeposits.reduce((a,b) => a+b.amount, 0)), // Math check
            });
            successCount++;
        }
    }

    if (mode === "commit") {
        const CHUNK_SIZE = 5; // Reduced concurrency limit to prevent Prisma connection pool overflow
        for (let i = 0; i < commitTasks.length; i += CHUNK_SIZE) {
            const chunk = commitTasks.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(fn => fn()));
        }
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
// Gaji Import (POT GAJI sheet)
// Reads: salary (GAJI BERSIH) + sisaGaji (JUMLAH GAJI DITERIMA / DITERIMA)
// ==========================================
async function processGajiImport(headers: string[], dataRows: string[][], mode: string) {
    const nrpIdx = headers.findIndex(h => h.includes("nrp") || h.includes("nip"));
    const namaIdx = headers.findIndex(h => h.includes("nama") || h.includes("nmpeg"));

    // Separate detection: sisaGaji (DITERIMA = Jumlah Gaji Diterima) vs salary (GAJI BERSIH / JML GAJI)
    const sisaGajiIdx = headers.findIndex(h => h.includes("diterima") || h.includes("jumlah gaji"));
    const salaryIdx = headers.findIndex(h => h.includes("gaji") && h.includes("bersih"));
    // Fallback: "jml gaji" (gross salary from POT GAJI merged header) or generic "gaji"/"salary"
    const fallbackSalaryIdx = headers.findIndex(h =>
        (h.includes("gaji") || h.includes("salary")) && !h.includes("diterima")
    );

    if (namaIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom NAMA tidak ditemukan di header file.",
            preview: [],
        };
    }

    const hasAnyGajiColumn = sisaGajiIdx !== -1 || salaryIdx !== -1 || fallbackSalaryIdx !== -1;
    if (!hasAnyGajiColumn) {
        return {
            success: 0, failed: 0,
            error: "Kolom Gaji tidak ditemukan. Cth: GAJI BERSIH, DITERIMA, atau JUMLAH GAJI DITERIMA.",
            preview: [],
        };
    }

    const allMembers = await prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, nrp: true, memberNo: true, salary: true, sisaGaji: true }
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

        // Read sisaGaji and salary from separate columns
        const sisaGaji = sisaGajiIdx !== -1 ? cleanNumber(row[sisaGajiIdx] || 0) : 0;
        const salary = salaryIdx !== -1 ? cleanNumber(row[salaryIdx] || 0) : (fallbackSalaryIdx !== -1 ? cleanNumber(row[fallbackSalaryIdx] || 0) : 0);

        // Determine what gets saved to Member.salary:
        // - If GAJI BERSIH exists: salary = GAJI BERSIH, sisaGaji = DITERIMA
        // - If JML GAJI + DITERIMA both exist (POT GAJI): salary = JML GAJI (gross), sisaGaji = DITERIMA
        // - If only DITERIMA: salary = DITERIMA (backward compat), sisaGaji = same
        // - If only GAJI BERSIH: salary = GAJI BERSIH, sisaGaji = 0
        const finalSalary = (salaryIdx !== -1 || fallbackSalaryIdx !== -1) ? salary : sisaGaji;
        const finalSisaGaji = sisaGaji;

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
                row: i + 2, nrp, nama: rawNama, gaji: finalSalary, sisaGaji: finalSisaGaji,
                status: 'error', reason: 'Anggota tdk ditemukan (daftarkan dulu via Import Akun Anggota)',
            });
            failCount++;
            continue;
        }

        // 4. When multiple name matches, disambiguate by closest existing salary
        if (matches.length > 1) {
            // Sort by closest salary match — prefer the member whose existing salary
            // is closest to the file salary (same person keeps their data)
            matches.sort((a: any, b: any) => {
                const diffA = Math.abs(Number(a.salary || 0) - finalSalary);
                const diffB = Math.abs(Number(b.salary || 0) - finalSalary);
                // If both have no salary, prefer the one with no salary at all
                if (diffA === diffB && diffA === finalSalary) {
                    return Number(a.sisaGaji || 0) - Number(b.sisaGaji || 0);
                }
                return diffA - diffB;
            });
        }

        const member = matches[0];

        if (mode === "commit") {
            await prisma.member.update({
                where: { id: member.id },
                data: {
                    salary: finalSalary,
                    ...(finalSisaGaji > 0 ? { sisaGaji: finalSisaGaji } : {}),
                },
            });
            member.salary = finalSalary as any;
            member.sisaGaji = finalSisaGaji as any;
        }

        results.push({
            row: i + 2, nrp: member.nrp || nrp, nama: rawNama, gaji: finalSalary, sisaGaji: finalSisaGaji,
            memberId: member.id, memberName: member.name,
            status: 'valid', reason: null,
            currentGaji: member.salary ? Number(member.salary) : null,
            currentSisaGaji: member.sisaGaji ? Number(member.sisaGaji) : null,
            salarySource: sisaGajiIdx !== -1 && salaryIdx !== -1 ? 'GAJI BERSIH + SISA GAJI' : sisaGajiIdx !== -1 ? 'SISA GAJI (DITERIMA)' : 'GAJI BERSIH',
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
// Gaji Uraian Import (from "uraian gaji" sheet — fixed column positions)
// ==========================================
async function processGajiUraianImport(dataRows: string[][], mode: string) {
    // Fixed column mapping for "uraian gaji" sheet:
    // C=2 PANGKAT, D=3 NAMA, E=4 NRP, G=6 NO REKENING, H=7 GAJI BERSIH, AK=36 JUMLAH GAJI DITERIMA (SISA GAJI)
    const PANGKAT = 2, NAMA = 3, NRP = 4, REKENING = 6, GAJI = 7, SISA_GAJI = 36;

    // Filter valid data rows (skip header rows: empty NRP, numeric nama, etc.)
    const validRows: { idx: number; row: string[] }[] = [];
    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length <= NRP) continue;

        const rawNama = String(row[NAMA] || '').trim();
        const rawNrp = String(row[NRP] || '').trim();

        if (!rawNama || rawNama.toUpperCase() === 'NAMA' || rawNama === '0') continue;
        if (/^\d+(\.\d+)?$/.test(rawNama)) continue;
        if (!rawNrp || rawNrp === '0') continue;

        validRows.push({ idx: i, row });
    }

    if (validRows.length === 0) {
        return {
            success: 0, failed: 0,
            error: "Tidak ada data valid ditemukan. Pastikan file menggunakan sheet 'uraian gaji' dengan kolom: PANGKAT (C), NAMA (D), NRP (E), GAJI BERSIH (H).",
            preview: [],
        };
    }

    const allMembers = await prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, nrp: true, memberNo: true, salary: true, sisaGaji: true, pangkat: true, noRekening: true }
    });

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const { idx, row } of validRows) {
        const rawNama = String(row[NAMA] || '').trim();
        const nrp = cleanNrp(row[NRP] || '');
        const pangkat = String(row[PANGKAT] || '').trim().toUpperCase();
        const rawRekening = String(row[REKENING] || '').trim();
        const rekening = rawRekening.replace(/['\- ]/g, '');
        // GAJI BERSIH (col H=7) → Member.salary; SISA GAJI / DITERIMA (col AK=36) → Member.sisaGaji
        const sisaGaji = row.length > SISA_GAJI ? cleanNumber(row[SISA_GAJI] || 0) : 0;
        const gajiBersih = cleanNumber(row[GAJI] || 0);
        const gaji = gajiBersih > 0 ? gajiBersih : sisaGaji; // display value: prefer gajiBersih

        // Match by NRP
        let member = allMembers.find(m => m.nrp === nrp || m.memberNo === nrp);

        // Fallback: exact name match
        if (!member) {
            const csvCleanName = cleanNameForMatch(rawNama);
            member = allMembers.find(m => cleanNameForMatch(m.name) === csvCleanName);
        }

        if (!member) {
            // Auto-register new member
            if (mode === "commit") {
                try {
                    const newMember = await prisma.$transaction(async (tx) => {
                        const created = await autoRegisterMember(nrp, rawNama, tx, gaji > 0 ? gaji : undefined);
                        // Update pangkat, noRekening, sisaGaji after creation
                        await tx.member.update({
                            where: { id: created.id },
                            data: {
                                ...(pangkat ? { pangkat } : {}),
                                ...(rekening ? { noRekening: rekening } : {}),
                                ...(sisaGaji > 0 ? { sisaGaji } : {}),
                            },
                        });
                        return { ...created, pangkat, noRekening: rekening };
                    });
                    allMembers.push({ id: newMember.id, name: newMember.name, nrp: newMember.nrp, memberNo: newMember.memberNo, salary: newMember.salary, sisaGaji: sisaGaji as any, pangkat, noRekening: rekening });

                    results.push({
                        row: idx + 2, nrp, nama: rawNama, gaji, gajiBersih, sisaGaji: sisaGaji > 0 ? sisaGaji : null, pangkat, rekening,
                        memberId: newMember.id, memberName: newMember.name,
                        status: 'valid', reason: null, isNewMember: true,
                        salarySource: `GAJI BERSIH (col H)${sisaGaji > 0 ? ' + SISA GAJI (col AK)' : ''}`,
                    });
                    successCount++;
                } catch (err) {
                    results.push({
                        row: idx + 2, nrp, nama: rawNama, gaji,
                        status: 'error', reason: 'Gagal mendaftarkan: ' + (err instanceof Error ? err.message : 'Unknown'),
                    });
                    failCount++;
                }
            } else {
                results.push({
                    row: idx + 2, nrp, nama: rawNama, gaji, gajiBersih, sisaGaji: sisaGaji > 0 ? sisaGaji : null, pangkat, rekening,
                    memberId: null, memberName: `[BARU] ${rawNama}`,
                    status: 'valid', reason: null, isNewMember: true,
                    salarySource: `GAJI BERSIH (col H)${sisaGaji > 0 ? ' + SISA GAJI (col AK)' : ''}`,
                });
                successCount++;
            }
            continue;
        }

        // Existing member — update salary (GAJI BERSIH), sisaGaji (JUMLAH DITERIMA), pangkat, noRekening
        if (mode === "commit") {
            await prisma.member.update({
                where: { id: member.id },
                data: {
                    salary: gajiBersih,
                    ...(sisaGaji > 0 ? { sisaGaji } : {}),
                    ...(pangkat ? { pangkat } : {}),
                    ...(rekening ? { noRekening: rekening } : {}),
                },
            });
        }

        results.push({
            row: idx + 2, nrp, nama: rawNama, gaji, gajiBersih, sisaGaji: sisaGaji > 0 ? sisaGaji : null, pangkat, rekening,
            memberId: member.id, memberName: member.name,
            status: 'valid', reason: null, isNewMember: false,
            salarySource: `GAJI BERSIH (col H)${sisaGaji > 0 ? ' + SISA GAJI (col AK)' : ''}`,
            currentGaji: member.salary ? Number(member.salary) : null,
            currentSisaGaji: member.sisaGaji ? Number(member.sisaGaji) : null,
        });
        successCount++;
    }

    return {
        mode, type: "gaji_uraian",
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
    const gajiIdx = headers.findIndex(h => h.includes("diterima") || h.includes("jumlah gaji"));
    const gajiFallbackIdx = gajiIdx !== -1 ? gajiIdx : headers.findIndex(h => h.includes("gaji") || h.includes("bersih") || h.includes("salary"));

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
        const gaji = gajiFallbackIdx >= 0 ? cleanNumber(row[gajiFallbackIdx] || 0) : 0;

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
        hasGaji: gajiFallbackIdx >= 0,
    };
}
