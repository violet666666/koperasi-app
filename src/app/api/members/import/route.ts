import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";

// POST /api/members/import - Import CSV data to update members
export async function POST(request: Request) {
    try {
        // Parse form data (multipart)
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const importType = (formData.get("type") as string) || "tunkin"; // tunkin, gaji, anggota
        const mode = (formData.get("mode") as string) || "preview"; // preview, commit

        if (!file) {
            return NextResponse.json(
                { message: "File CSV wajib diupload" },
                { status: 400 }
            );
        }

        // Read file content
        const text = await file.text();

        // Parse CSV with robust handling
        const rows = parseCSV(text);

        if (rows.length === 0) {
            return NextResponse.json(
                { message: "File CSV kosong atau format tidak valid" },
                { status: 400 }
            );
        }

        // Detect headers
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const dataRows = rows.slice(1);

        // Validate and process based on type
        let result;
        switch (importType) {
            case "tunkin":
                result = await processTunkinImport(headers, dataRows, mode);
                break;
            case "gaji":
                result = await processGajiImport(headers, dataRows, mode);
                break;
            default:
                return NextResponse.json(
                    { message: `Tipe import '${importType}' tidak didukung` },
                    { status: 400 }
                );
        }

        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("POST /api/members/import error:", error);
        return NextResponse.json(
            { message: "Gagal memproses import data" },
            { status: 500 }
        );
    }
}

// ==========================================
// CSV Parser (handles quotes, commas, etc)
// ==========================================
function parseCSV(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    return lines.map(line => {
        const values: string[] = [];
        let curVal = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(curVal.trim());
                curVal = '';
            } else {
                curVal += char;
            }
        }
        values.push(curVal.trim());
        return values;
    });
}

// ==========================================
// Clean helpers
// ==========================================
function cleanNrp(raw: string): string {
    return raw.replace(/^'/, '').replace(/\.0$/, '').trim();
}

function cleanNumber(raw: string): number {
    const cleaned = raw.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// ==========================================
// Tunkin Import
// ==========================================
async function processTunkinImport(headers: string[], dataRows: string[][], mode: string) {
    // Try to find NRP column
    const nrpIdx = headers.findIndex(h =>
        h.includes("nrp") || h.includes("nip") || h === "nrp/nip"
    );
    const namaIdx = headers.findIndex(h => h.includes("nama"));
    const tunkinIdx = headers.findIndex(h =>
        h.includes("tunkin") || h.includes("tunjangan") || h.includes("tunles")
    );

    if (nrpIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom NRP/NIP tidak ditemukan di header CSV. Header yang ditemukan: " + headers.join(", "),
            preview: [],
        };
    }

    if (tunkinIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom Tunkin/Tunjangan tidak ditemukan di header CSV. Header yang ditemukan: " + headers.join(", "),
            preview: [],
        };
    }

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const nrp = cleanNrp(row[nrpIdx] || '');
        const nama = row[namaIdx] || '-';
        const tunkin = cleanNumber(row[tunkinIdx] || '0');

        if (!nrp) {
            results.push({
                row: i + 2, nrp: '', nama, tunkin,
                status: 'error', reason: 'NRP/NIP kosong'
            });
            failCount++;
            continue;
        }

        // Find member
        const member = await prisma.member.findFirst({
            where: {
                OR: [{ nrp }, { memberNo: nrp }],
                deletedAt: null,
            },
        });

        if (!member) {
            results.push({
                row: i + 2, nrp, nama, tunkin,
                status: 'error', reason: 'Anggota tidak ditemukan di database'
            });
            failCount++;
            continue;
        }

        if (mode === "commit") {
            await prisma.member.update({
                where: { id: member.id },
                data: { tunlesKinerja: tunkin },
            });
        }

        results.push({
            row: i + 2, nrp, nama, tunkin,
            memberId: member.id, memberName: member.name,
            status: 'valid', reason: null,
            currentTunkin: member.tunlesKinerja ? Number(member.tunlesKinerja) : null,
        });
        successCount++;
    }

    return {
        mode,
        type: "tunkin",
        totalRows: dataRows.length,
        success: successCount,
        failed: failCount,
        preview: results.slice(0, 100), // limit preview to 100 rows
        allResults: mode === "commit" ? results : undefined,
    };
}

// ==========================================
// Gaji Import
// ==========================================
async function processGajiImport(headers: string[], dataRows: string[][], mode: string) {
    const nrpIdx = headers.findIndex(h =>
        h.includes("nrp") || h.includes("nip") || h === "nrp/nip"
    );
    const namaIdx = headers.findIndex(h => h.includes("nama") || h.includes("nmpeg"));
    const gajiIdx = headers.findIndex(h =>
        h.includes("gaji") || h.includes("bersih") || h.includes("salary")
    );

    if (nrpIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom NRP/NIP tidak ditemukan di header CSV",
            preview: [],
        };
    }

    if (gajiIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom Gaji/Bersih tidak ditemukan di header CSV",
            preview: [],
        };
    }

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const nrp = cleanNrp(row[nrpIdx] || '');
        const nama = row[namaIdx] || '-';
        const gaji = cleanNumber(row[gajiIdx] || '0');

        if (!nrp) {
            results.push({
                row: i + 2, nrp: '', nama, gaji,
                status: 'error', reason: 'NRP/NIP kosong'
            });
            failCount++;
            continue;
        }

        const member = await prisma.member.findFirst({
            where: {
                OR: [{ nrp }, { memberNo: nrp }],
                deletedAt: null,
            },
        });

        if (!member) {
            results.push({
                row: i + 2, nrp, nama, gaji,
                status: 'error', reason: 'Anggota tidak ditemukan di database'
            });
            failCount++;
            continue;
        }

        if (mode === "commit") {
            await prisma.member.update({
                where: { id: member.id },
                data: { salary: gaji },
            });
        }

        results.push({
            row: i + 2, nrp, nama, gaji,
            memberId: member.id, memberName: member.name,
            status: 'valid', reason: null,
            currentGaji: member.salary ? Number(member.salary) : null,
        });
        successCount++;
    }

    return {
        mode,
        type: "gaji",
        totalRows: dataRows.length,
        success: successCount,
        failed: failCount,
        preview: results.slice(0, 100),
        allResults: mode === "commit" ? results : undefined,
    };
}
