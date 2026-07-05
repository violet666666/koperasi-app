import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";
import {
    parsePayrollExcel,
    commitPayrollPeriod,
    PayrollImportError,
    MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS,
    ALLOWED_SOURCES,
} from "@/lib/services/payroll-import";

export const maxDuration = 300;

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
        if (!ALLOWED_SOURCES.includes(sourceType)) {
            return NextResponse.json({ message: "sourceType harus 'polres' atau 'polsek'" }, { status: 400 });
        }

        // Parse + member-match (shared helper — single source of truth w/ mobile)
        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await parsePayrollExcel(buffer, sourceType, file.name);

        // Preview mode
        if (mode === "preview") {
            return NextResponse.json({
                data: {
                    mode: "preview",
                    sheetName: parsed.sheetName,
                    periodName: parsed.periodInfo.periodName,
                    periodMonth: parsed.periodInfo.periodMonth,
                    periodYear: parsed.periodInfo.periodYear,
                    sourceFile: file.name,
                    sourceType,
                    totalRows: parsed.counts.totalRows,
                    success: parsed.counts.success,
                    failed: parsed.counts.failed,
                    preview: parsed.rows.slice(0, 50).map((s, idx) => ({
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
                    columnCount: parsed.columnCount,
                    headers: parsed.headers,
                },
            });
        }

        // Commit mode — $transaction create + slips + sisaGaji sync (shared helper)
        const result = await commitPayrollPeriod(parsed.rows, parsed.periodInfo, sourceType, file.name, adminId);

        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "IMPORT", module: "Payroll",
                description: `Import gaji ${result.periodName}: ${result.counts.totalRows} anggota`,
                newData: { periodId: result.periodId, totalMembers: result.counts.totalRows },
            });
        } catch {
            // Audit logging failure should not block the import
        }

        return NextResponse.json({
            data: {
                mode: "commit",
                periodId: result.periodId,
                periodName: result.periodName,
                totalRows: result.counts.totalRows,
                success: result.counts.success,
                failed: parsed.counts.failed,
            },
        });
    } catch (error: unknown) {
        // Map typed helper errors (400 no-sheet/bad-header, 409 duplicate) to their HTTP status,
        // preserving the original response shape byte-identically (incl. existingPeriodId on 409).
        if (error instanceof PayrollImportError) {
            const body: { message: string; existingPeriodId?: number } = { message: error.statusMessage };
            if (error.existingPeriodId !== undefined) {
                body.existingPeriodId = error.existingPeriodId;
            }
            return NextResponse.json(body, { status: error.statusCode });
        }
        console.error("POST /api/payroll/import error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ message: "Gagal memproses file gaji: " + message }, { status: 500 });
    }
}
