import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

export const maxDuration = 300;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const ALLOWED_SOURCE_TYPES = ["polres", "polsek"];
const DEFAULT_SISA_REKENING = 100_000; // minimum balance retained in BRI account

// Koperasi-specific deduction keywords (mapped to structured fields)
const KOPERASI_FIELDS: Record<string, keyof Pick<SlipData, "potTajib" | "potSP" | "potBarang" | "potSukarela" | "potKoperasiLain">> = {
    "TAJIP": "potTajib",
    "TAJIB": "potTajib",
    "TABUNGAN WAJIB": "potTajib",
    "SP PRIMKOPPOL": "potSP",
    "SP PRIM": "potSP",
    "ANGSURAN SP": "potSP",
    "BARANG PRIMKOPPOL": "potBarang",
    "BARANG PRIM": "potBarang",
    "SUKARELA": "potSukarela",
    "SIMPANAN SUKARELA": "potSukarela",
    "SIMPedes KOPERASI": "potKoperasiLain",
    "KOPERASI BHY": "potKoperasiLain",
};

// Summary field keywords (mapped to BRI total fields)
const SUMMARY_FIELDS: Record<string, keyof Pick<SlipData, "jumlahPotNonBRI" | "jumlahPotBRI" | "terimaBersih">> = {
    "JUMLAH POT NON": "jumlahPotNonBRI",
    "JUMLAH POTONGAN NON": "jumlahPotNonBRI",
    "JML POT NON": "jumlahPotNonBRI",
    "JUMLAH POT KRETAP": "jumlahPotBRI",
    "JUMLAH POTONGAN BRI": "jumlahPotBRI",
    "JML POT BRI": "jumlahPotBRI",
    "JUMLAH GAJI DITERIMA": "terimaBersih",
    "JML GAJI DITERIMA": "terimaBersih",
    "GAJI DITERIMA": "terimaBersih",
};

// Identity field keywords
const IDENTITY_FIELDS: Record<string, "no" | "pangkat" | "nama" | "nrp" | "gajiBersih"> = {
    "NO": "no",
    "PANGKAT": "pangkat",
    "NAMA": "nama",
    "NRP": "nrp",
    "NIP": "nrp",
    "NRP/NIP": "nrp",
    "JML GAJI": "gajiBersih",
    "GAJI BERSIH": "gajiBersih",
};

interface SlipData {
    nrp: string;
    nama: string;
    pangkat: string;
    gajiBersih: number;
    tunkin: number;
    potTajib: number;
    potSP: number;
    potBarang: number;
    potSukarela: number;
    potKoperasiLain: number;
    totalPotKoperasi: number;
    sisaGaji: number;
    sisaTunkin: number;
    otherDeductions: Record<string, number>;
    jumlahPotNonBRI: number;
    jumlahPotBRI: number;
    terimaBersih: number;
    sisaRekening: number;
    bisaDiambilATM: number;
    memberId: number | null;
}

function cleanNumber(raw: string | number | undefined): number {
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === "number") return raw;
    const s = String(raw).trim();
    if (s === "-" || s === "" || s === "Rp" || s === "Rp.") return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function cleanNrp(raw: string): string {
    return String(raw).replace(/['"]/g, "").replace(/\.0$/, "").trim();
}

function normalizeHeader(h: string): string {
    return String(h).toUpperCase().trim().replace(/[^A-Z0-9\s/]/g, "").replace(/\s+/g, " ");
}

function matchKeyword(header: string, keywords: Record<string, string>): string | null {
    const normalized = normalizeHeader(header);
    for (const [keyword, value] of Object.entries(keywords)) {
        if (normalized.includes(keyword)) return value;
    }
    return null;
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as { name: string })?.name;
        if (roleName !== "operator") {
            return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
        }
        const adminId = Number(session.user.id);
        if (!adminId) {
            return NextResponse.json({ message: "Session tidak valid" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview";
        const sourceType = ((formData.get("sourceType") as string) || "polres").toLowerCase();

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }

        // File size validation
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ message: "File terlalu besar (maks 10MB)" }, { status: 400 });
        }

        // File type validation
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json({ message: "Format file harus .xlsx, .xls, atau .csv" }, { status: 400 });
        }

        // Source type validation
        if (!ALLOWED_SOURCE_TYPES.includes(sourceType)) {
            return NextResponse.json({ message: "sourceType harus 'polres' atau 'polsek'" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: "buffer" });

        // Find POT GAJI sheet
        let sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes("POT GAJI"));
        if (!sheetName) {
            sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes("POTONGAN"));
        }
        if (!sheetName) {
            return NextResponse.json({ message: "Sheet 'POT GAJI' tidak ditemukan dalam file" }, { status: 400 });
        }

        const ws = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

        if (rows.length < 3) {
            return NextResponse.json({ message: "Sheet kosong" }, { status: 400 });
        }

        // Find header row (look for row containing NRP or NAMA)
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
            const rowStr = rows[i].join(" ").toUpperCase();
            if ((rowStr.includes("NRP") || rowStr.includes("NIP")) && rowStr.includes("NAMA")) {
                headerRowIdx = i;
                break;
            }
        }
        if (headerRowIdx === -1) {
            return NextResponse.json({ message: "Header row tidak ditemukan. Pastikan sheet memiliki kolom NRP dan NAMA." }, { status: 400 });
        }

        const headerRow = rows[headerRowIdx];

        // Build column mapping from header
        // Priority: summary > koperasi > identity > other
        // This prevents "JUMLAH GAJI DITERIMA" from matching "JML GAJI" (identity)
        const colMap: Record<number, { type: string; field?: string }> = {};
        for (let col = 0; col < headerRow.length; col++) {
            const header = String(headerRow[col] || "").trim();
            if (!header) continue;

            const normalizedHeader = normalizeHeader(header);

            // Check summary fields FIRST — keywords like "DITERIMA", "POTONGAN", "NON", "KRETAP" indicate totals
            const summaryField = matchKeyword(header, SUMMARY_FIELDS);
            if (summaryField) {
                colMap[col] = { type: "summary", field: summaryField };
                continue;
            }

            const koperasiField = matchKeyword(header, KOPERASI_FIELDS);
            if (koperasiField) {
                colMap[col] = { type: "koperasi", field: koperasiField };
                continue;
            }

            const identityField = matchKeyword(header, IDENTITY_FIELDS);
            if (identityField) {
                colMap[col] = { type: "identity", field: identityField };
                continue;
            }

            if (normalizedHeader.includes("BRI") || normalizedHeader.includes("SUDIRMAN") || normalizedHeader.includes("CABANG") || normalizedHeader.includes("UNIT LAIN")) {
                colMap[col] = { type: "bri", field: header };
                continue;
            }

            if (!["NO", "URUT", "KETERANGAN", "KET", "REKENING", "NO REK", "NPWP"].some(skip => normalizedHeader.includes(skip))) {
                colMap[col] = { type: "other", field: header };
            }
        }

        // Parse period from file name
        const fileName = file.name;
        const monthNames = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
        let periodMonth = new Date().getMonth() + 1;
        let periodYear = new Date().getFullYear();
        for (let m = 0; m < monthNames.length; m++) {
            if (fileName.toUpperCase().includes(monthNames[m])) {
                periodMonth = m + 1;
                break;
            }
        }
        const yearMatch = fileName.match(/(20\d{2})/);
        if (yearMatch) periodYear = parseInt(yearMatch[1]);
        const periodName = `${monthNames[periodMonth - 1].charAt(0) + monthNames[periodMonth - 1].slice(1).toLowerCase()} ${periodYear}`;

        // Load members for matching
        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true, tunlesKinerja: true },
        });

        // Parse data rows
        const slips: SlipData[] = [];
        const skippedRows: number[] = [];

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 3) { skippedRows.push(i + 1); continue; }

            let nrp = "";
            let nama = "";
            let pangkat = "";
            let gajiBersih = 0;

            for (const [colStr, mapping] of Object.entries(colMap)) {
                const col = parseInt(colStr);
                if (mapping.type !== "identity" || !mapping.field) continue;
                const val = row[col];
                if (mapping.field === "nrp") nrp = cleanNrp(String(val || ""));
                else if (mapping.field === "nama") nama = String(val || "").trim();
                else if (mapping.field === "pangkat") pangkat = String(val || "").trim();
                else if (mapping.field === "gajiBersih") gajiBersih = cleanNumber(val);
            }

            if (!nama || nama.toUpperCase() === "NAMA" || nama.toUpperCase().includes("JUMLAH") || nama.toUpperCase().includes("TOTAL")) { skippedRows.push(i + 1); continue; }
            if (!nrp && !nama) { skippedRows.push(i + 1); continue; }
            if (/^\d+(\.\d+)?$/.test(nama)) { skippedRows.push(i + 1); continue; }

            const otherDeductions: Record<string, number> = {};
            const slip: SlipData = {
                nrp, nama, pangkat, gajiBersih,
                tunkin: 0,
                potTajib: 0, potSP: 0, potBarang: 0, potSukarela: 0, potKoperasiLain: 0,
                totalPotKoperasi: 0, sisaGaji: 0, sisaTunkin: 0,
                otherDeductions,
                jumlahPotNonBRI: 0, jumlahPotBRI: 0,
                terimaBersih: 0, sisaRekening: DEFAULT_SISA_REKENING, bisaDiambilATM: 0,
                memberId: null,
            };

            for (const [colStr, mapping] of Object.entries(colMap)) {
                const col = parseInt(colStr);
                const val = cleanNumber(row[col]);

                if (mapping.type === "koperasi" && mapping.field) {
                    (slip as unknown as Record<string, unknown>)[mapping.field] = val;
                } else if (mapping.type === "summary" && mapping.field) {
                    (slip as unknown as Record<string, unknown>)[mapping.field] = val;
                } else if (mapping.type === "other" || mapping.type === "bri") {
                    if (mapping.field) otherDeductions[mapping.field] = val;
                }
            }

            let member = nrp ? allMembers.find(m => m.nrp === nrp || m.memberNo === nrp) : null;
            if (!member && nama) {
                const cleanNama = nama.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
                member = allMembers.find(m => {
                    const mClean = m.name.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
                    return mClean === cleanNama || mClean.includes(cleanNama) || cleanNama.includes(mClean);
                });
            }

            slip.memberId = member?.id || null;
            slip.tunkin = member?.tunlesKinerja ? Number(member.tunlesKinerja) : 0;

            slip.totalPotKoperasi = slip.potTajib + slip.potSP + slip.potBarang + slip.potSukarela + slip.potKoperasiLain;
            slip.sisaGaji = Math.max(0, slip.gajiBersih - slip.totalPotKoperasi);
            slip.sisaTunkin = Math.max(0, slip.tunkin);
            slip.bisaDiambilATM = Math.max(0, slip.terimaBersih - slip.sisaRekening);

            slips.push(slip);
        }

        // Preview mode
        if (mode === "preview") {
            return NextResponse.json({
                data: {
                    mode: "preview",
                    sheetName,
                    periodName,
                    periodMonth,
                    periodYear,
                    sourceFile: fileName,
                    sourceType,
                    totalRows: slips.length,
                    success: slips.length,
                    failed: skippedRows.length,
                    preview: slips.slice(0, 50).map((s, idx) => ({
                        row: idx + 1,
                        nrp: s.nrp,
                        nama: s.nama,
                        pangkat: s.pangkat,
                        gajiBersih: s.gajiBersih,
                        potTajib: s.potTajib,
                        potSP: s.potSP,
                        potBarang: s.potBarang,
                        totalPotKoperasi: s.totalPotKoperasi,
                        sisaGaji: s.sisaGaji,
                        terimaBersih: s.terimaBersih,
                        memberId: s.memberId,
                        status: s.memberId ? "valid" : "no_match",
                    })),
                    columnCount: Object.keys(colMap).length,
                    headers: headerRow.filter((h: string) => h && String(h).trim()),
                },
            });
        }

        // Commit mode
        const existing = await prisma.payrollPeriod.findUnique({
            where: { periodMonth_periodYear_sourceType: { periodMonth, periodYear, sourceType } },
        });
        if (existing) {
            return NextResponse.json({
                message: `Data gaji ${periodName} (${sourceType}) sudah ada. Hapus terlebih dahulu jika ingin import ulang.`,
                existingPeriodId: existing.id,
            }, { status: 409 });
        }

        const period = await prisma.$transaction(async (tx) => {
            const p = await tx.payrollPeriod.create({
                data: {
                    periodName,
                    periodMonth,
                    periodYear,
                    sourceFile: fileName,
                    sourceType,
                    status: "processed",
                    totalMembers: slips.length,
                    totalGaji: slips.reduce((sum, s) => sum + s.gajiBersih, 0),
                    totalPotongan: slips.reduce((sum, s) => sum + s.totalPotKoperasi, 0),
                    createdById: adminId,
                },
            });

            const BATCH = 100;
            for (let i = 0; i < slips.length; i += BATCH) {
                const batch = slips.slice(i, i + BATCH);
                await tx.payrollSlip.createMany({
                    data: batch.map(s => ({
                        periodId: p.id,
                        memberId: s.memberId,
                        nrp: s.nrp,
                        nama: s.nama,
                        pangkat: s.pangkat,
                        gajiBersih: s.gajiBersih,
                        tunkin: s.tunkin,
                        potTajib: s.potTajib,
                        potSP: s.potSP,
                        potBarang: s.potBarang,
                        potSukarela: s.potSukarela,
                        potKoperasiLain: s.potKoperasiLain,
                        totalPotKoperasi: s.totalPotKoperasi,
                        sisaGaji: s.sisaGaji,
                        sisaTunkin: s.sisaTunkin,
                        otherDeductions: s.otherDeductions,
                        jumlahPotNonBRI: s.jumlahPotNonBRI,
                        jumlahPotBRI: s.jumlahPotBRI,
                        terimaBersih: s.terimaBersih,
                        sisaRekening: s.sisaRekening,
                        bisaDiambilATM: s.bisaDiambilATM,
                    })),
                });
            }
            return p;
        }, { timeout: 60000 });

        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "IMPORT", module: "Payroll",
                description: `Import gaji ${periodName}: ${slips.length} anggota`,
                newData: { periodId: period.id, totalMembers: slips.length },
            });
        } catch (e) {
            // Audit logging failure should not block the import
        }

        return NextResponse.json({
            data: {
                mode: "commit",
                periodId: period.id,
                periodName,
                totalRows: slips.length,
                success: slips.length,
                failed: skippedRows.length,
            },
        });
    } catch (error: unknown) {
        console.error("POST /api/payroll/import error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ message: "Gagal memproses file gaji: " + message }, { status: 500 });
    }
}
